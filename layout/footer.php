    <div class="modal fade" id="ICTRSHD" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-sm" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title" id="smallModalLabel">Instalasi ICT RSHD Barabai</h4>
                </div>
                <div class="modal-body">
                    Ditetapkan sebagai Instalasi ICT dengan Surat Keputusan Direktur Rumah Sakit Umum Daerah H. Damanhuri pada tanggal 1 November 2017.
                    <ul style="list-style:none;margin-left:0;padding-left:0;"><br>
                        <li><b>Kepala Instalasi : <br>MasBas (drg. Faisol Basoro)</b></li><br>
                        <li>Anggota :
                            <ul style="list-style:none;margin-left:0;padding-left:0;">
                                <li>- Amat (Muhammad Ma'ruf, S.Kom)</li>
                                <li>- Aruf (Ma'ruf, S.Kom)</li>
                                <li>- Didi (Didi Andriawan, S.Kom)</li>
                                <li>- Adly (M. Adly Hidayat, S.Kom)</li>
                                <li>- Ridho (M. Alfian Ridho, S.Kom)</li>
                                <li>- Ijai (Zailani)</li>
                                <li>- Ina (Inarotut Darojah)</li>
                            </ul>
                        </li>
                    </ul>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-link waves-effect" data-dismiss="modal">TUTUP</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Jquery Core Js -->
    <script src="plugins/jquery/jquery.min.js"></script>

    <!-- Bootstrap Core Js -->
    <script src="plugins/bootstrap/js/bootstrap.js"></script>

    <!-- Select Plugin Js -->
    <script src="plugins/bootstrap-select/js/bootstrap-select.js"></script>

    <!-- Slimscroll Plugin Js -->
    <script src="plugins/jquery-slimscroll/jquery.slimscroll.js"></script>

    <!-- Jquery Validation Plugin Css -->
    <script src="plugins/jquery-validation/jquery.validate.js"></script>

    <!-- JQuery Steps Plugin Js -->
    <script src="plugins/jquery-steps/jquery.steps.js"></script>

    <!-- Sweet Alert Plugin Js -->
    <script src="plugins/sweetalert/sweetalert.min.js"></script>

    <!-- Waves Effect Plugin Js -->
    <script src="plugins/node-waves/waves.js"></script>

    <!-- Jquery DataTable Plugin Js -->
    <script src="plugins/jquery-datatable/jquery.dataTables.js"></script>
    <script src="plugins/jquery-datatable/skin/bootstrap/js/dataTables.bootstrap.js"></script>
    <script src="plugins/jquery-datatable/extensions/responsive/js/dataTables.responsive.min.js"></script>

    <!-- Jquery CountTo Plugin Js -->
    <script src="plugins/jquery-countto/jquery.countTo.js"></script>

    <!-- Highcharts Plugin Js -->
	  <script src="plugins/highcharts/highcharts.js"></script>
    <script src="plugins/highcharts/exporting.js"></script>

    <!-- Chart Plugins Js -->
    <script src="plugins/chartjs/Chart.bundle.js"></script>

    <!-- Sparkline Chart Plugin Js -->
    <script src="plugins/jquery-sparkline/jquery.sparkline.js"></script>

    <!-- Autosize Plugin Js -->
    <script src="plugins/autosize/autosize.js"></script>

    <!-- Moment Plugin Js -->
    <script src="plugins/momentjs/moment.js"></script>
    <script src="plugins/light-gallery/js/lightgallery-all.js"></script>
	<script>

	$(function () {
    	$('#aniimated-thumbnials').lightGallery({
        	thumbnail: true,
        	selector: 'a'
    	});
	});

	</script>


    <!-- Bootstrap Material Datetime Picker Plugin Js -->
    <script src="plugins/bootstrap-material-datetimepicker/js/bootstrap-material-datetimepicker.js"></script>

    <script src="assets/js/jquery-ui.min.js"></script>
    <script src="assets/js/select2.min.js"></script>

    <!-- Odontogram Js -->
    <script src="assets/js/odontogram.js"></script>

    <!-- TinyMCE -->
    <script src="plugins/tinymce/tinymce.js"></script>
	<script>
    $(function () {

        //TinyMCE
        tinymce.init({
            selector: "textarea#tinymce",
            theme: "modern",
            height: 200,
            plugins: [
                'advlist autolink lists link image charmap print preview hr anchor pagebreak',
                'searchreplace wordcount visualblocks visualchars code fullscreen',
                'insertdatetime media nonbreaking save table contextmenu directionality',
                'emoticons template paste textcolor colorpicker textpattern imagetools'
            ],
            toolbar1: 'insertfile undo redo | styleselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | forecolor backcolor',
            image_advtab: true
        });
        tinymce.suffix = ".min";
        tinyMCE.baseURL = 'plugins/tinymce';
    });
	</script>
    <!-- Custom Js -->
    <script src="assets/js/admin.js"></script>

	  <script>

      var url = window.location.pathname; //sets the variable "url" to the pathname of the current window
      var activePage = url.substring(url.lastIndexOf('/') + 1); //sets the variable "activePage" as the substring after the last "/" in the "url" variable
      if($('.menu li a > .active').length > 0){
        $('.active').removeClass('active');//remove current active element if there's
      }
      $('.menu li a').each(function () { //looks in each link item within the primary-nav list
        var linkPage = this.href.substring(this.href.lastIndexOf('/') + 1); //sets the variable "linkPage" as the substring of the url path in each &lt;a&gt;
        if (activePage == linkPage) { //compares the path of the current window to the path of the linked page in the nav item
          $(this).parents('li').addClass('active');
          $(this).parent().addClass('active'); //if the above is true, add the "active" class to the parent of the &lt;a&gt; which is the &lt;li&gt; in the nav list
        }
      });

      $(document).ready(function() {
          if (location.hash) {
              $("a[href='" + location.hash + "']").tab("show");
          }
          $(document.body).on("click", "a[data-toggle='tab']", function(event) {
              location.hash = this.getAttribute("href");
          });
      });
      $(window).on("popstate", function() {
          var anchor = location.hash || $("a[data-toggle='tab']").first().attr("href");
          $("a[href='" + anchor + "']").tab("show");
      });

      $(window).on('load',function(){
           $('#pengumuman').modal('show');
      });

      $('.color').colorPicker();
        
	  </script>


	<script>

        $(document).ready(function() {

            //var url = window.location.pathname; //sets the variable "url" to the pathname of the current window
            //var activePage = url.substring(url.lastIndexOf('/') + 1); //sets the variable "activePage" as the substring after the last "/" in the "url" variable
            //if($('.active').length > 0){
            //   $('.active').removeClass('active');//remove current active element if there's
            //}

            //$('.menu li a').each(function () { //looks in each link item within the primary-nav list
            //    var linkPage = this.href.substring(this.href.lastIndexOf('/') + 1); //sets the variable "linkPage" as the substring of the url path in each &lt;a&gt;

            //    if (activePage == linkPage) { //compares the path of the current window to the path of the linked page in the nav item
            //        $(this).parent().addClass('active'); //if the above is true, add the "active" class to the parent of the &lt;a&gt; which is the &lt;li&gt; in the nav list
            //    }
            //});

            //Textare auto growth
            autosize($('textarea.auto-growth'));

            $('.datepicker').bootstrapMaterialDatePicker({
                format: 'YYYY-MM-DD',
                clearButton: true,
                weekStart: 1,
                time: false
            });
          
          	$(".tglprk").bootstrapMaterialDatePicker({
                format: 'YYYY-MM-DD',
                clearButton: true,
                weekStart: 1,
                time: false
            }).on("change", function(e) {
                var kode = $("#tglprk").val();
                $.ajax({
                    url: './includes/noreg.php',
                    data: "kode="+kode,
                }).success(function (data){
                var json = data,
                    obj = JSON.parse(json);
                        $('#noreg').val(obj.noreg);
                });
            });

            $('.count-to').countTo();

            $('#riwayatmedis').dataTable( {
	          	responsive: true, 
				order: [[ 0, 'desc' ]]
            } );

            $('#datatable').dataTable( {
	          	responsive: true
            } );

            $('#datatable_ralan').dataTable( {
	          	responsive: true,
				order: [[ 2, 'asc' ]]
            } );
            $('#datatable_ranap').dataTable( {
	          	responsive: true,
				order: [[ 4, 'asc' ]]
            } );
            $('#datatable_booking').dataTable( {
	          	responsive: true,
				order: [[ 1, 'asc' ]]
            } );

        } );
	</script>

	<script type="text/javascript">
        Highcharts.chart('kunjungan', {
		    chart: {
			    type: 'column'
			},
            exporting: {
                enabled: false
            },
		    title: {
			    text: 'Grafik Kunjungan'
			},
			subtitle: {
				text: <?=json_encode($dates);?>
			},
		    xAxis: {
		        categories: <?=json_encode($poli);?> ,

				title: {
				    enabled: false
				}
			},
			yAxis: {
				title: {
					text: 'Jumlah Pasien'
				},
				labels: {
					formatter: function () {
						return this.value;
					}
				}
			},
			tooltip: {
				split: true,
				valueSuffix: ''
			},
			plotOptions: {
				area: {
				stacking: 'normal',
				lineColor: '#666666',
				lineWidth: 1,
			    	marker: {
						lineWidth: 1,
						lineColor: '#666666'
					}
				}
			},
			series: [{
				name: 'Poliklinik dan Rawat Jalan',
				data: <?=json_encode($jumlah);?>
			}]
		});
	</script>

    <script type="text/javascript">

        function formatData (data) {
            var $data = $(
                '<b>'+ data.id +'</b> - <i>'+ data.text +'</i>'
            );
            return $data;
        };

        function formatDataTEXT (data) {
            var $data = $(
                '<b>'+ data.text +'</b>'
            );
            return $data;
        };

        function formatDataObat (data) {
            var $data = $(
                '<b>'+ data.id +'</b> - <i>'+ data.text +' [ Stok: '+ data.jumlah +' ]</i>'
            );
            return $data;
        };
      
        $('.kd_diagnosa').select2({
            placeholder: 'Pilih diagnosa',
            ajax: {
                url: 'includes/select-diagnosa.php',
                dataType: 'json',
                delay: 250,
                    processResults: function (data) {
                        return {
                            results: data
                        };
                    },
                cache: true
            },
            templateResult: formatData,
            minimumInputLength: 3
        });

        $('.kd_prosedur').select2({
            placeholder: 'Pilih Prosedur',
            ajax: {
                url: 'includes/select-prosedur.php',
                dataType: 'json',
                delay: 250,
                    processResults: function (data) {
                        return {
                            results: data
                        };
                    },
                cache: true
            },
            templateResult: formatData,
            minimumInputLength: 3
        });

        $('.kd_perawatan').select2({
            placeholder: 'Pilih Perawatan',
            ajax: {
                url: 'includes/select-perawatan.php',
                dataType: 'json',
                delay: 250,
                    processResults: function (data) {
                        return {
                            results: data
                        };
                    },
                cache: true
            },
            templateResult: formatData,
            minimumInputLength: 3
        });
      
        $('.prioritas').select2({
            placeholder: 'Pilih prioritas diagnosa'
        });

        $('.kd_obat').select2({
          placeholder: 'Pilih obat',
          ajax: {
            url: 'includes/select-obat.php',
            dataType: 'json',
            delay: 250,
            processResults: function (data) {
              return {
                results: data
              };
            },
            cache: true
          },
          templateResult: formatDataObat,
      	minimumInputLength: 3
        });

        $('.kd_obat_ralan').select2({
          placeholder: 'Pilih obat',
          ajax: {
            url: 'includes/select-obat-ralan.php',
            dataType: 'json',
            delay: 250,
            processResults: function (data) {
              return {
                results: data
              };
            },
            cache: true
          },
          templateResult: formatDataObat,
      	minimumInputLength: 3
        });


      
        $('.aturan_pakai').select2({
            placeholder: 'Pilih aturan pakai'
        });

        $('.pasien').select2({
          placeholder: 'Pilih nama/no.RM pasien',
          ajax: {
            url: 'includes/select-pasien.php',
            dataType: 'json',
            delay: 250,
            processResults: function (data) {
              return {
                results: data
              };
            },
            cache: true
          },
          templateResult: formatData,
          minimumInputLength: 3
        });

        $('.kd_jenis_prw_lab').select2({
            placeholder: 'Pilih Jenis',
            ajax: {
                url: 'includes/select-laboratorium.php',
                dataType: 'json',
                delay: 250,
                    processResults: function (data) {
                        return {
                            results: data
                        };
                    },
                cache: true
            },
            templateResult: formatData,
            minimumInputLength: 3
        });

        $('.kd_jenis_prw_rad').select2({
            placeholder: 'Pilih Jenis',
            ajax: {
                url: 'includes/select-radiology.php',
                dataType: 'json',
                delay: 250,
                    processResults: function (data) {
                        return {
                            results: data
                        };
                    },
                cache: true
            },
            templateResult: formatData,
            minimumInputLength: 3
        });

        $(function () {
             $('#row_dim').hide();
             $('#lainnya').change(function () {
                 $('#row_dim').hide();
                 if (this.options[this.selectedIndex].value == 'lainnya') {
                     $('#row_dim').show();
                 }
             });
         });

        $(function () {
             $('#row_dim_pulang').hide();
             $('#lainnya_pulang').change(function () {
                 $('#row_dim_pulang').hide();
                 if (this.options[this.selectedIndex].value == 'lainnya') {
                     $('#row_dim_pulang').show();
                 }
             });
         });

      
    </script>

    <script>

$(document).ready(function(){
     $(window).scroll(function () {
            if ($(this).scrollTop() > 50) {
                $('#back-to-top').fadeIn();
            } else {
                $('#back-to-top').fadeOut();
            }
        });
        // scroll body to 0px on click
        $('#back-to-top').click(function () {
            $('#back-to-top').tooltip('hide');
            $('body,html').animate({
                scrollTop: 0
            }, 800);
            return false;
        });
        
        $('#back-to-top').tooltip('show');

});
      
   </script>

<script>
$(document).ready(function(){
	var total;
	var width,html = "",label = "";
function loading(){
	$(".poll").html("<div style='padding-left:45%'><img src='poll/477.gif'></div>");
}
	// load first question
	get_poll();

	$(".button").on("click",function(){
		var ans = $("input[type=radio]:checked").val();

		if(ans){
			loading();
$(".poll-content > ul").empty();
			$.ajax({
				type: "POST",
				url: "poll/ajax.php",
				data : "act=suba&ans="+ans,
				dataType: "json",
				success: function(response){

					total = response.total;
					if(response.success == 1){
						html="";
						$.each(response.opt, function(aid,label) {
							if(response.details[aid] == undefined){
								width  = 0
								acount = 0
							}else{
								acount = response.details[aid];
								width = Math.round((parseInt(acount)/parseInt(total)) * 100);
							}
							if(width < 50 ){ var alert = "danger"} else if((width >=50) && (width <= 75)){ var alert = "primary"; }else{alert="success"}
	html+='<li class="list-group-item"><label>'+label+' ('+acount+' votes)</label></label><div class="progress"><div class="progress-bar  progress-bar-'+alert+'" style="width:'+width+'%">'+width+'%</div></div></li>';
								});

						html += '<p><span class="total">Total votes : <b>'+total+'</b></span>';
						$(".poll").html("");
						$(".poll-content > ul").append(html);
						$(".poll-content > ul").slideDown("slow");

					}else{
						alert("Seems Something Error ?");
					}
				}
			});

		}
	});
});

function get_poll(){
	loading();
	$(".poll-content > ul").html("");
	$.ajax({
		type: "POST",
		url: "poll/ajax.php",
		data : "act=getq",
		dataType: "json",
		success: function(response){
			var ans1, ans = "";
			if($(".poll").html().length)
			$(".poll").css("display","none");
			if(response.id){
				$.each(response.answers, function(i,val) {

					ans+='<li class="list-group-item"><div class="radio"><label><input class="rad" type="radio" name="poll_options" id="'+i+'" value="'+i+'"/><label for="'+i+'">'+val+'</label></label></div></li>';

				});
				$(".poll").html("");
				$(".question").html(response.question);
				$(".poll-content > ul").append(ans);
			}else{
				$(".next").remove();
				$(".question").html('');
				$(".button").remove();
				$(".poll").fadeIn("slow").html("<span class='err'>OOPS. No more question there! :(</span>");
			}
		}
	});
}

function loading(){
	$(".poll").html("<div style='padding-left:45%'><img src='poll/477.gif'></div>");
}
</script>


</body>

</html>
