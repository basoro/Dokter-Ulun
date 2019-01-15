<?php

/***
* SIMRS Khanza Lite from version 0.1 Beta
* About : Porting of SIMRS Khanza by Windiarto a.k.a Mas Elkhanza as web and mobile app.
* Last modified: 02 Pebruari 2018
* Author : drg. Faisol Basoro
* Email : drg.faisol@basoro.org
* Licence under GPL
***/

$title = 'Data Pasien';
include_once('config.php');
include_once('layout/header.php');
include_once('layout/sidebar.php');
?>

    <section class="content">
        <div class="container-fluid">
            <div class="row clearfix">
                <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                    <div class="card">
                        <div class="header">
                            <h2>
                                GALLERY PASIEN
                            </h2>
                        </div>
                        <div class="body">
                                        <div id="aniimated-thumbnials" class="list-unstyled row clearfix">
                                        <?php
                                        $sql_rad = query("select * from berkas_digital_perawatan where no_rawat= '2018/12/17/000290' and kode='005'");
                                        $no=1;
                                        while ($row_rad = fetch_array($sql_rad)) {
                                            echo '<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">';
                                            echo '<a href="http://simrs.rshdbarabai.com/berkasrawat/'.$row_rad[2].'" data-sub-html=""><img class="img-responsive thumbnail"  src="http://simrs.rshdbarabai.com/berkasrawat/'.$row_rad[2].'"></a>';
                                            echo '</div>';
                                            $no++;
                                        }
                                        ?>

                                      </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

<?php
include_once('layout/footer.php');
?>


